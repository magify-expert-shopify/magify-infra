FROM postgres:17-alpine

COPY init/001-create-users-and-databases.sql /docker-entrypoint-initdb.d/001-create-users-and-databases.sql
COPY init/002-import-sql-dumps.sh /docker-entrypoint-initdb.d/002-import-sql-dumps.sh
COPY *.sql /docker-entrypoint-initdb.d/sql/

RUN chmod 755 /docker-entrypoint-initdb.d/002-import-sql-dumps.sh
