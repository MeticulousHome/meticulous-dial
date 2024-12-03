import { createGlobalStyle } from 'styled-components';
import './fonts.css';

export const GlobalStyles = createGlobalStyle`

html,
body {
  width: 480px;
  height: 480px;
  margin: 0;
  overflow: hidden;
}

body {
  font-family: 'Abc';
  color: white;
  background-color: black;
  display: flex;
  justify-content: center;
  align-items: center;
}
`;
