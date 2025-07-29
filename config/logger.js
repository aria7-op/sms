const logger = {
  error: (...args) => {
    console.error(new Date().toISOString(), 'ERROR:', ...args);
  },
  info: (...args) => {
    console.info(new Date().toISOString(), 'INFO:', ...args);
  },
  warn: (...args) => {
    console.warn(new Date().toISOString(), 'WARN:', ...args);
  },
  debug: (...args) => {
    console.log(new Date().toISOString(), 'DEBUG:', ...args);
  }
};

export default  logger ;
