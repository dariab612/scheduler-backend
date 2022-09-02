CREATE SCHEMA IF NOT EXISTS scheduler;

create sequence user_id_seq;

alter sequence user_id_seq owner to postgres;

create table "user"
(
    id                 integer default nextval('scheduler.user_id_seq'::regclass) not null
        constraint user_pk
            primary key,
    display_name       varchar,
    email              varchar,
    password_hash      varchar,
    preferred_earliest varchar,
    preferred_latest   varchar,
    timezone           varchar
);

alter table "user"
    owner to postgres;

alter sequence user_id_seq owned by "user".id;

create sequence meetings_id_seq;
alter sequence meetings_id_seq owner to postgres;
create table "meetings"
(
    id                 integer default nextval('scheduler.meetings_id_seq'::regclass) not null
        constraint meetings_pk
            primary key,
    title       varchar,
    preferred_earliest timestamptz,
    preferred_latest   timestamptz
);
alter sequence meetings_id_seq owned by "meetings".id;

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

alter table scheduler.meetings_users
    owner to postgres;


