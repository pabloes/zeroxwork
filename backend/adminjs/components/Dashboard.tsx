/* eslint-disable linebreak-style */
/* eslint-disable react/jsx-filename-extension */
/* eslint-disable react/function-component-definition */

import React from 'react';
import { useTranslation } from 'adminjs';
import { Box, Button, Text } from '@adminjs/design-system';

/**
 * El panel. Lleva la descarga de la copia de seguridad porque una copia que
 * exige SSH y acordarse de la sintaxis de pg_dump es una copia que no se hace,
 * y hace falta justo antes de las operaciones que no tienen vuelta atras.
 *
 * Es un enlace normal, no una llamada con javascript: el navegador manda la
 * cookie de sesion igual, y el fichero va a Descargas sin pasar por memoria.
 */
const Dashboard = () => {
  const { t } = useTranslation();

  return (
    <Box position="relative" overflow="hidden">
      <Text textAlign="center" fontSize="xl">{t('Bienvenido a su panel de administrador')}</Text>

      <Box variant="card" mt="xxl" mx="auto" width={560} maxWidth="100%">
        <Text fontWeight="bold">Copia de seguridad</Text>
        <Text mt="default">
          Un volcado completo de la base de datos, comprimido. Hazlo antes de
          cualquier cambio que no tenga vuelta atras.
        </Text>
        <Text mt="default" variant="sm" color="grey60">
          Lleva dentro los correos y los hashes de contraseña de todo el mundo.
          No lo dejes en Descargas ni lo subas a ningún sitio.
        </Text>
        <Box mt="xl">
          <Button as="a" href="/admin/backup.sql.gz" variant="primary">
            Descargar copia
          </Button>
        </Box>
        <Text mt="xl" variant="sm" color="grey60">
          Para restaurarla, cárgala en una base de datos nueva y comprueba lo
          que hay dentro antes de cambiar nada:
          <br />
          <code>gunzip -c zeroxwork-….sql.gz | psql &quot;…/zeroxwork_restaurada&quot;</code>
        </Text>
      </Box>
    </Box>
  );
};

export default Dashboard;
