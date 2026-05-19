class ErrorFailedGettingLoggedUser extends Error {
  public readonly statusCode: 404;
  constructor(message: string) {
    super(message);
    this.name = 'ErrorFailedGettingLoggedUser';
  }
}

export default ErrorFailedGettingLoggedUser;
