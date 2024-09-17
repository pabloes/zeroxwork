/* eslint-disable linebreak-style */
/* eslint-disable react/jsx-filename-extension */
/* eslint-disable react/function-component-definition */

import React from 'react';
import { useTranslation } from 'adminjs';
import { Box, Text } from '@adminjs/design-system';

const Dashboard = () => {
  const { t } = useTranslation();

  return (
    <Box position="relative" overflow="hidden">
      <Text textAlign="center" fontSize="xl">{t('Bienvenido a su panel de administrador')}</Text>
    </Box>
  );
};

export default Dashboard;
