-- =====================================================
-- CARAVANAS SMART - Esquema del backend (MySQL)
--
-- Es el mismo modelo del análisis original, con UN cambio
-- necesario para soportar carga offline desde el celular:
-- las claves primarias son CHAR(36) (UUID) en lugar de
-- INT AUTO_INCREMENT. Motivo: el id se genera en el propio
-- celular al crear un registro sin conexión; si fuera un
-- número autoincremental, dos celulares offline podrían
-- generar el mismo id y chocar al sincronizar. Con UUID,
-- cada id es único sin necesidad de coordinarse con el
-- servidor. El resto del modelo (tablas, relaciones,
-- restricciones UNIQUE/NOT NULL/ENUM) es igual al definido
-- en el análisis.
-- =====================================================

CREATE DATABASE IF NOT EXISTS caravanas_smart
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE caravanas_smart;

CREATE TABLE IF NOT EXISTS usuarios (
    id               CHAR(36) PRIMARY KEY,
    nombre_completo  VARCHAR(100) NOT NULL,
    email            VARCHAR(150) NOT NULL,
    contrasena_hash  VARCHAR(255) NOT NULL,
    fecha_registro   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuarios_email UNIQUE (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS establecimientos (
    id                      CHAR(36) PRIMARY KEY,
    usuario_id              CHAR(36) NOT NULL,
    nombre_establecimiento  VARCHAR(100) NOT NULL,
    ubicacion               VARCHAR(150) NULL,
    CONSTRAINT uq_establecimientos_usuario UNIQUE (usuario_id),
    CONSTRAINT fk_establecimientos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS animales (
    id                   CHAR(36) PRIMARY KEY,
    establecimiento_id   CHAR(36) NOT NULL,
    especie              ENUM('vaca','oveja') NOT NULL,
    sexo                 ENUM('macho','hembra') NULL,
    fecha_nacimiento     DATE NULL,
    raza                 VARCHAR(80) NULL,
    peso                 DECIMAL(6,2) NULL,
    estado               ENUM('activo','vendido','fallecido','trasladado') NOT NULL DEFAULT 'activo',
    observaciones        TEXT NULL,
    fecha_registro       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_animales_establecimiento
        FOREIGN KEY (establecimiento_id) REFERENCES establecimientos(id) ON DELETE RESTRICT,
    INDEX idx_animales_especie (especie),
    INDEX idx_animales_raza (raza),
    INDEX idx_animales_estado (estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS caravanas (
    id                  CHAR(36) PRIMARY KEY,
    identificador_nfc   VARCHAR(64) NOT NULL,
    animal_id           CHAR(36) NULL,
    fecha_registro      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    activa              BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_caravanas_nfc UNIQUE (identificador_nfc),
    CONSTRAINT uq_caravanas_animal UNIQUE (animal_id),
    CONSTRAINT fk_caravanas_animal
        FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registros_sanitarios (
    id             CHAR(36) PRIMARY KEY,
    animal_id      CHAR(36) NOT NULL,
    tipo_registro  ENUM('vacuna','tratamiento') NOT NULL,
    descripcion    VARCHAR(200) NOT NULL,
    fecha          DATE NOT NULL,
    observaciones  TEXT NULL,
    CONSTRAINT fk_registros_animal
        FOREIGN KEY (animal_id) REFERENCES animales(id) ON DELETE CASCADE,
    INDEX idx_registros_animal (animal_id),
    INDEX idx_registros_tipo (tipo_registro)
) ENGINE=InnoDB;
