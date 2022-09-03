CREATE SCHEMA IF NOT EXISTS scheduler;

create table scheduler."user"
(
    id  serial primary key,
    display_name       varchar,
    email              varchar,
    password_hash      varchar,
    preferred_earliest varchar,
    preferred_latest   varchar,
    timezone           varchar
);



