 /*    SENTENCIAS DE CREACION DE TABLAS   */

CREATE TABLE IF NOT EXISTS "solicitud_suspension" ("id" serial PRIMARY KEY, "matricula" int NOT NULL, "fecha" date NOT NULL, "motivo" text NOT NULL, "estado" int NOT NULL, "created_by" int NOT NULL, "created_at" timestamp NOT NULL DEFAULT CURRENT_DATE, "updated_by" int NOT NULL, "updated_at" timestamp NOT NULL DEFAULT CURRENT_DATE, FOREIGN KEY ( "matricula" ) REFERENCES "matricula" ( "id" ) ON DELETE CASCADE, FOREIGN KEY ( "estado" ) REFERENCES "t_estadosolicitud" ( "id" ), FOREIGN KEY ( "created_by" ) REFERENCES "usuario" ( "id" ), FOREIGN KEY ( "updated_by" ) REFERENCES "usuario" ( "id" ));