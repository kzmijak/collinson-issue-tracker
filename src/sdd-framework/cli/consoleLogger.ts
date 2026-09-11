/* eslint-disable no-console */

export interface Logger {
  info: (line: string) => void;
  error: (line: string) => void;
}

export const consoleLogger: Logger = {
  info: (line) => console.log(line),
  error: (line) => console.error(line),
};
