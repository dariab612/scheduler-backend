const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const checkAuth = require('./middleware');
const { Client } = require('pg')
const bcrypt = require('bcrypt');
const saltRounds = 10;

// pg part

let client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'password',
    port: 5432,
})
connect()

async function connect () {
    try {
        await client.connect()
        await client.query('SELECT NOW()')
    } catch (err) {
        console.error("failed to connect to the DB", err)
        process.exit(1)
    }
}

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const secret = 'canyoukeepasecret';

app.get('/api/healthcheck', function(req, res){
    res.status(200).send("OK");
})

app.post('/api/register', async function(req, res) {
    const { email, password,  display_name, preferred_earliest, preferred_latest, timezone } = req.body;

    if (!email || !password || !display_name || !preferred_latest || !preferred_earliest || !timezone) {
        res.status(400).send("email, password,  display_name, preferred_earliest, preferred_latest, timezone are required");
        return
    }

    try {
        let password_hash = await bcrypt.hash(password, saltRounds)
        await client.query(`
            INSERT INTO scheduler.user
            (email, password_hash, display_name, preferred_earliest, preferred_latest, timezone)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [email, password_hash, display_name, preferred_earliest, preferred_latest, timezone])
    } catch (err) {
        res.status(500).send(err);
        return
    }

    res.status(200).send("Successful registration");
});

app.post('/api/authenticate', async function(req, res) {
    const { email, password } = req.body;

    try {
        let result = await client.query(`
            SELECT * FROM scheduler.user
            WHERE email = $1
            LIMIT 1
        `, [email])

        if (!result || !result.rows.length) {
            res.status(401).send("User Not found");
            return
        }

        let user = result.rows[0]

        if (!bcrypt.compareSync(password, user.password_hash)) {
            res.status(401).send("Wrong password");
            return
        }

        const payload = {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            preferred_earliest: user.preferred_earliest,
            preferred_latest: user.preferred_latest,
            timezone: user.timezone
        };
        const token = jwt.sign(payload, secret, {
            expiresIn: '1h'
        });
        res.cookie('token', token, { httpOnly: true }).sendStatus(200);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/meeting', checkAuth, async function(req, res) {
    const { title, preferred_earliest, preferred_latest, attendees } = req.body;

    if (!title || !preferred_latest || !preferred_earliest || !attendees) {
        res.status(400).send("title, preferred_latest, preferred_earliest, attendees are required");
        return
    }

    try {
        let result = await client.query(`
            INSERT INTO scheduler.meetings
            (title, preferred_earliest, preferred_latest)
            VALUES ($1, $2, $3)
            RETURNING id
        `, [title, preferred_earliest, preferred_latest])

        let meeting = result.rows[0]

        // add the creator of meeting as attendee
        for (let i = 0; i < attendees.length; i++) {
            await client.query(`
                INSERT INTO scheduler.meetings_users
                (meeting_id, user_id)
                VALUES ($1, $2)
            `, [meeting.id, attendees[i]])
        }
    } catch (err) {
        res.status(500).send(err);
        return
    }

    res.status(200).send("Successful registration");
});

app.get('/api/meetings', checkAuth, async function(req, res) {
    try {
        let result = await client.query(`
            SELECT m.* AS meeting_users FROM scheduler.meetings m
            JOIN scheduler.meetings_users mu ON mu.meeting_id = m.id
            WHERE mu.user_id = $1
            ORDER BY m.agreed_time
        `, [req.user_data.id])

        let meetings = result.rows

        res.status(200).json(meetings)
    } catch (err) {
        console.error(err)
        res.status(500).send(err);
    }
})

app.get('/checkToken', checkAuth, function(req, res) {
    res.sendStatus(200);
});

app.listen(process.env.PORT || 8080);
console.info("Server started")

