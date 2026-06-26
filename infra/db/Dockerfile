FROM postgres:17-alpine

COPY init/001-create-users.sql /docker-entrypoint-initdb.d/001-create-users.sql
COPY init/002-create-databases.sql /docker-entrypoint-initdb.d/002-create-databases.sql
