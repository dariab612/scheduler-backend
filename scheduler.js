const moment = require('moment')
require('moment-timezone')

module.exports = class Scheduler {
    constructor (dbClient) {
        this.dbClient = dbClient
    }

    async start() {
        // continuously try to schedule
        try {
            await this.tryToSchedule()
        } catch(err) {
            console.error("scheduler error", err)
        } finally {
            // even if there was an error in scheduling process, we should still keep trying in next interaction
            setTimeout(this.start.bind(this), 5000)
        }
    }

    async tryToSchedule() {
        // Get a single unscheduled meeting
        let unscheduledMeetings = await this.getAllUnScheduledMeetings()
        if (!unscheduledMeetings || !unscheduledMeetings.length) {
            // nothing to schedule
            console.log("Nothing to schedule")
            return
        }

        console.log(`Trying to schedule ${unscheduledMeetings.length} meetings`)
        let scheduledCounter = 0

        // iterate over unscheduled meetings and try to schedule
        for (let i = 0; i < unscheduledMeetings.length; i++) {
            let unscheduledMeeting = unscheduledMeetings[i]
            // 1. Get list of meeting attendees
            let attendees = await this.getMeetingAttendees(unscheduledMeeting.id)
            // 2. Generate Intervals using meeting preferred earliest and latest dates
            let meetingIntervals = this.generateMeetingPrefIntervals(unscheduledMeeting)
            // 3. Use the meeting preferred intervals and find intersecting intervals with every attendee preferences
            let attendeesPrefIntervals = this.generateAttendeePrefIntervals(meetingIntervals, attendees)
            // 4. Find free intervals for meeting days when attendees don't have any other meeting already scheduled
            let attendeesFreeForMeetingIntervals = await this.getAttendeesFreeForMeetingIntervals(meetingIntervals, attendees)
            // 5. Find intersections of intervals of user preferred meeting times and user general availability
            let bestTimeForAttendees = this.generateBestIntervals(attendeesPrefIntervals, attendeesFreeForMeetingIntervals)
            // 6. Find an interval that is intersecting with all attendees availability
            let agreed_time = this.findSuitableInterval(bestTimeForAttendees)
            if (agreed_time) {
                // 7. We found an interval that is suitable for all attendees, so we can update the agreed time of meeting
                await this.updateMeetingWithAgreedTime(unscheduledMeeting, agreed_time)
                scheduledCounter++
            }
        }

        console.log(`Managed to schedule ${scheduledCounter} out of total ${unscheduledMeetings.length} unscheduled meetings`)
    }

    async updateMeetingWithAgreedTime(meeting, agreed_time) {
        await this.dbClient.query(`
            UPDATE scheduler.meetings
            SET agreed_time = $1
            WHERE id = $2
        `, [agreed_time.start, meeting.id])
    }

    generateBestIntervals(attendeesPrefIntervals, attendeesFreeForMeetingIntervals) {
        let bestIntervals = []
        Object.keys(attendeesPrefIntervals).forEach((key) => {
            let prefIntervals = attendeesPrefIntervals[key]
            let freeFromMeetingsIntervals = attendeesFreeForMeetingIntervals[key]

            let res = this.checkIntersectingIntervals(prefIntervals, freeFromMeetingsIntervals)

            bestIntervals.push(res)
        })
        return bestIntervals
    }

    async getAttendeesFreeForMeetingIntervals(meetingIntervals, attendees) {
        let busyIntervals = await this.getAttendeesAlreadyScheduledIntervals(meetingIntervals, attendees)
        let freeIntervals = {}

        Object.keys(busyIntervals).forEach((key) => {
            let userBusyIntervals = busyIntervals[key]
            if (!userBusyIntervals.length) {
                let userFreeIntervals = []
                for (let i = 0; i < meetingIntervals.length; i++) {
                    userFreeIntervals.push({
                        start: moment(meetingIntervals[i].start).startOf('day').toISOString(),
                        end: moment(meetingIntervals[i].end).endOf('day').toISOString()
                    })
                }

                freeIntervals[key] = userFreeIntervals
                return
            }

            userBusyIntervals = sortIntervals(userBusyIntervals)
            let userFreeIntervals = [
                {
                    start: moment(userBusyIntervals[0].start).startOf('day').toISOString(),
                    end: moment(userBusyIntervals[0].start).toISOString()
                }
            ]

            for (let i = 1; i < userBusyIntervals.length; i++) {
                userFreeIntervals.push({
                    start: moment(userBusyIntervals[i - 1].end).toISOString(),
                    end: moment(userBusyIntervals[i].start).toISOString()
                })
            }

            userFreeIntervals.push({
                start: moment(userBusyIntervals[userBusyIntervals.length - 1].end).toISOString(),
                end: moment(userBusyIntervals[userBusyIntervals.length - 1].end).endOf('day').toISOString()
            })

            freeIntervals[key] = userFreeIntervals
        })

        return freeIntervals
    }

    findSuitableInterval(userIntervals) {
        for (let i = 0; i < userIntervals.length; i++) {
            let proposedIntervals = userIntervals[i]

            for (let j = 1; j < userIntervals.length; j++) {
                let anotherUserIntervals = userIntervals[j]
                proposedIntervals = this.checkIntersectingIntervals(proposedIntervals, anotherUserIntervals)

                if (!proposedIntervals) {
                    return false
                }
            }

            if (!proposedIntervals) {
                return false
            }

            return proposedIntervals[0]
        }
    }

    async getAttendeesAlreadyScheduledIntervals(meetingIntervals, attendees,) {
        let intervals = {}
        for (let i = 0; i < attendees.length; i++) {
            let attendee = attendees[i];
            for (let j = 0; j < meetingIntervals.length; j++) {
                let meetingInterval = meetingIntervals[j]

                let result = await this.dbClient.query(`
                    SELECT m.* FROM scheduler.meetings m
                    JOIN scheduler.meetings_users mu ON mu.meeting_id = m.id
                    WHERE mu.user_id = $1
                    AND m.agreed_time IS NOT NULL
                    AND m.agreed_time BETWEEN $2 AND $3
                    ORDER BY m.agreed_time
                `, [attendee.id, meetingInterval.start, meetingInterval.end])

                let meetings = result.rows
                let attendeeBusyintervals = []

                meetings.forEach((meeting) => {
                    attendeeBusyintervals.push({
                        start: meeting.agreed_time.toISOString(),
                        end: moment(meeting.agreed_time).add(meeting.duration_in_minutes, "minute").toISOString()
                    })
                })

                intervals[attendee.id] = attendeeBusyintervals
            }
        }

        return intervals
    }

    generateAttendeePrefIntervals(meetingIntervals, attendees) {
        let intervals = {}
        attendees.forEach((attendee) => {
            let attendeeIntervals = []

            meetingIntervals.forEach((meetingInterval) => {
                let meetingDate = moment(meetingInterval.start).format("YYYY-MM-DD")
                let generatedDateFormat = "YYYY-MM-DD HH:mm Z"
                let attendeePrefStartForTheDay = moment(`${meetingDate} ${attendee.preferred_earliest} ${attendee.timezone}`, generatedDateFormat).toISOString()
                let attendeePrefEndForTheDay = moment(`${meetingDate} ${attendee.preferred_latest} ${attendee.timezone}`, generatedDateFormat).toISOString()

                attendeeIntervals.push({
                    start: moment(attendeePrefStartForTheDay).isAfter(meetingInterval.start) ? attendeePrefStartForTheDay : meetingInterval.start,
                    end: moment(attendeePrefEndForTheDay).isBefore(meetingInterval.end) ? attendeePrefEndForTheDay : meetingInterval.end
                })
            })

            intervals[attendee.id] = attendeeIntervals
        })

        return intervals
    }

    generateMeetingPrefIntervals(meeting) {
        let intervals = []
        let currDate = moment(meeting.preferred_earliest).format("YYYY-MM-DD")
        let endDate = moment(meeting.preferred_latest).format("YYYY-MM-DD")

        if (currDate === endDate) {
            // if meeting preference is in the same day, then just return the interval
            intervals.push({
                start: meeting.preferred_earliest.toISOString(),
                end: meeting.preferred_latest.toISOString()
            })
            return intervals
        }

        // add the first day interval starting from `preferred_earliest` to the end of the same day
        intervals.push({
            start: meeting.preferred_earliest.toISOString(),
            end:  moment(currDate).endOf('day').toISOString()
        })

        // add all other days fully that are in between `preferred_earliest` and `preferred_latest`
        while (currDate !== endDate) {
            intervals.push({
                start: moment(currDate).startOf('day').toISOString(),
                end: moment(currDate).endOf('day').toISOString()
            })

            currDate = moment.utc(currDate).add(1, 'day').format("YYYY-MM-DD")
        }

        // add the last day interval starting from the beginning of the last day until `preferred_latest`
        intervals.push({
            start: moment(currDate).startOf('day').toISOString(),
            end:  meeting.preferred_latest.toISOString()
        })

        return intervals
    }

    async getAllUnScheduledMeetings() {
        let result = await this.dbClient.query(`
            SELECT * FROM scheduler.meetings
            WHERE agreed_time IS NULL
        `)

        return result.rows
    }

    async getMeetingAttendees(meeting_id) {
        let result = await this.dbClient.query(`
            SELECT u.* FROM scheduler.meetings_users mu
            JOIN scheduler.user u ON mu.user_id = u.id
            WHERE meeting_id = $1
        `, [meeting_id])

        return result.rows
    }

    checkIntersectingIntervals(intervalsA, intervalsB) {
        let intersectingIntervals = []
        for (let i = 0; i < intervalsA.length; i++) {
            let intervalA = intervalsA[i]

            for (let j = 0; j < intervalsB.length; j++) {
                let intervalB = intervalsB[j]

                if (this.areIntersecting([intervalA, intervalB])) {
                    intersectingIntervals.push(this.findIntersection([intervalA, intervalB]))
                }
            }
        }
        return intersectingIntervals
    }

    areIntersecting(intervals) {
        intervals = sortIntervals(intervals)
        return moment(intervals[1].start).isBefore(intervals[0].end)
    }

    findIntersection(intervals) {
        intervals = this.sortIntervals(intervals)
        let intersection = {}
        if (moment(intervals[0].start).isAfter(intervals[1].start)) {
            intersection.start = intervals[0].start
        } else {
            intersection.start = intervals[1].start
        }

        if (moment(intervals[0].end).isBefore(intervals[1].end)) {
            intersection.end = intervals[0].end
        } else {
            intersection.end = intervals[1].end
        }
        return intersection
    }

    sortIntervals(intervals) {
        return intervals.sort((a, b) => {
            if (moment(a.start).isBefore(b.start)) {
                return -1
            }

            if (moment(a.start).isAfter(b.start)) {
                return 1
            }

            return 0
        })
    }
}

function sortIntervals(intervals) {
    return intervals.sort((a, b) => {
        if (moment(a.start).isBefore(b.start)) {
            return -1
        }

        if (moment(a.start).isAfter(b.start)) {
            return 1
        }

        return 0
    })
}
