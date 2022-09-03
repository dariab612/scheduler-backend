create table scheduler."meeting_preference"
(
    id serial primary key,
    earliest       varchar,
    latest varchar,
    timezone   varchar,
    user_id    integer not null
        constraint meeting_preference_users_user_null_fk
            references scheduler."user"
);