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

