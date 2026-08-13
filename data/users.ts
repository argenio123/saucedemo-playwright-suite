/**
 * Account catalogue for https://www.saucedemo.com/
 *
 * The site publishes six accounts on its own login page. Four of them are
 * deliberately defective - they exist so that a suite can be proven to detect
 * faults rather than only to confirm the happy path. Each profile below records
 * what the account is expected to do so the specs can be driven from data.
 */

export const PASSWORD = 'secret_sauce';

export type UserName =
  | 'standard_user'
  | 'locked_out_user'
  | 'problem_user'
  | 'performance_glitch_user'
  | 'error_user'
  | 'visual_user';

export type UserProfile = {
  username: UserName;
  password: string;
  /** Does this account reach /inventory.html at all? */
  canLogin: boolean;
  /** What the account is documented to do wrong once it is in. */
  knownBehaviour: string;
};

export const USERS: Record<UserName, UserProfile> = {
  standard_user: {
    username: 'standard_user',
    password: PASSWORD,
    canLogin: true,
    knownBehaviour: 'Reference account. Every flow is expected to work.',
  },
  locked_out_user: {
    username: 'locked_out_user',
    password: PASSWORD,
    canLogin: false,
    knownBehaviour: 'Authentication is refused with a lock-out message.',
  },
  problem_user: {
    username: 'problem_user',
    password: PASSWORD,
    canLogin: true,
    knownBehaviour: 'Product images and some form fields are defective.',
  },
  performance_glitch_user: {
    username: 'performance_glitch_user',
    password: PASSWORD,
    canLogin: true,
    knownBehaviour: 'Sign-in is deliberately slow. Used for the latency budget.',
  },
  error_user: {
    username: 'error_user',
    password: PASSWORD,
    canLogin: true,
    knownBehaviour: 'Errors are raised part-way through the purchase journey.',
  },
  visual_user: {
    username: 'visual_user',
    password: PASSWORD,
    canLogin: true,
    knownBehaviour: 'Layout and styling defects are injected into the pages.',
  },
};

/** Exact banner copy, asserted verbatim so a wording change is caught. */
export const LOGIN_ERRORS = {
  lockedOut: 'Epic sadface: Sorry, this user has been locked out.',
  mismatch: 'Epic sadface: Username and password do not match any user in this service',
  usernameRequired: 'Epic sadface: Username is required',
  passwordRequired: 'Epic sadface: Password is required',
} as const;

/** Copy shown when a deep link is requested without a session. */
export function guardMessage(path: string) {
  return `Epic sadface: You can only access '${path}' when you are logged in.`;
}
