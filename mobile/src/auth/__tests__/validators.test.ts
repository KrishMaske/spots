import { checkPasswordPolicy, isValidEmail, passwordsMatch } from '../validators';

describe('isValidEmail', () => {
  it('accepts a plausible email', () => {
    expect(isValidEmail('krish@example.com')).toBe(true);
  });

  it.each(['', 'not-an-email', 'missing-domain@', '@missing-local.com', 'spaces in@email.com'])(
    'rejects %p',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    }
  );
});

describe('checkPasswordPolicy', () => {
  // Mirrors backend/deploy/aws/cognito-user-pool.yml PasswordPolicy.
  it('accepts a password meeting every rule', () => {
    const result = checkPasswordPolicy('Correct1Horse!');
    expect(result.valid).toBe(true);
  });

  it('rejects a password that is too short', () => {
    const result = checkPasswordPolicy('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.minLength).toBe(false);
  });

  it('rejects a password missing a lowercase letter', () => {
    const result = checkPasswordPolicy('ALLCAPS123!!!!');
    expect(result.valid).toBe(false);
    expect(result.hasLowercase).toBe(false);
  });

  it('rejects a password missing an uppercase letter', () => {
    const result = checkPasswordPolicy('alllower123!!!!');
    expect(result.valid).toBe(false);
    expect(result.hasUppercase).toBe(false);
  });

  it('rejects a password missing a number', () => {
    const result = checkPasswordPolicy('NoNumbersHere!!!');
    expect(result.valid).toBe(false);
    expect(result.hasNumber).toBe(false);
  });

  it('rejects a password missing a symbol', () => {
    const result = checkPasswordPolicy('NoSymbolsHere123');
    expect(result.valid).toBe(false);
    expect(result.hasSymbol).toBe(false);
  });
});

describe('passwordsMatch', () => {
  it('matches identical non-empty passwords', () => {
    expect(passwordsMatch('Correct1Horse!', 'Correct1Horse!')).toBe(true);
  });

  it('rejects differing passwords', () => {
    expect(passwordsMatch('Correct1Horse!', 'Correct1Horse?')).toBe(false);
  });

  it('rejects two empty passwords', () => {
    expect(passwordsMatch('', '')).toBe(false);
  });
});
