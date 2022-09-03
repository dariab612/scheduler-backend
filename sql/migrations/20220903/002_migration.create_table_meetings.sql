create table scheduler."meetings"
(
    id serial primary key,
    title       varchar,
    preferred_earliest timestamptz,
    preferred_latest   timestamptz
);

create table scheduler.meetings_users
(
    user_id    integer not null
        constraint meetings_users_user_null_fk
            references scheduler."user",
    meeting_id integer not null
        constraint meetings_users_meetings_null_fk
            references scheduler.meetings,
    rsvp       varchar
);