/* eslint-disable linebreak-style */
/* eslint-disable react/jsx-filename-extension */
/* eslint-disable react/function-component-definition */
import React from 'react';
import { createGlobalStyle } from 'styled-components';
import {
  Box,
  H2,
  Label,
  Input,
  FormGroup,
  Button,
  Text,
  MessageBox,
} from '@adminjs/design-system';
import { useTranslation } from 'adminjs';

const GlobalStyle = createGlobalStyle`
  html, body, #app {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
  }
`;

export type LoginProps = {
  // eslint-disable-next-line react/require-default-props
  message?: string
  action: string
}

export const Login: React.FC<LoginProps> = (props) => {
  const { action, message } = props;
  const {
    translateLabel, translateButton, translateProperty, translateMessage,
  } = useTranslation();

  return (
    <>
      <GlobalStyle />
      <Box flex justifyContent="center" variant="grey">
        <Box bg="white" height="440px" flex justifyContent="center" boxShadow="login" width={[1, 2 / 3, 'auto']}>
          <Box
            bg="white"
            color="grey"
            p="x3"
            width="380px"
            flexGrow={0}
            display={['none', 'none', 'block']}
            position="relative"
          >
            <H2 fontWeight="lighter">{translateLabel('Welcome')}</H2>
            <Text fontWeight="lighter" mt="default">
              {translateMessage('Login to your test app dashboard')}
            </Text>
          </Box>
          <Box as="form" action={action} method="POST" p="x3" flexGrow={1} width={['100%', '100%', '480px']}>
            {message && (
              <MessageBox
                my="lg"
                message={message.split(' ').length > 1 ? message : translateMessage(message)}
                variant="danger"
              />
            )}
            <FormGroup>
              <Label required>{translateProperty('email')}</Label>
              <Input name="email" placeholder={translateProperty('email')} />
            </FormGroup>
            <FormGroup>
              <Label required>{translateProperty('password')}</Label>
              <Input
                type="password"
                name="password"
                placeholder={translateProperty('password')}
                autoComplete="new-password"
              />
            </FormGroup>
            <Text mt="xl" textAlign="center">
              <Button variant="secondary">{translateButton('login')}</Button>
            </Text>
            <Text mt="lg" textAlign="center">
              {translateMessage('forgotPasswordQuestion')}
              <a href="/forgot-password">{translateMessage('forgotPassword')}</a>
            </Text>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default Login;
