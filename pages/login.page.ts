import { expect, Locator, Page } from '@playwright/test';
import { PASSWORD } from '../data/users';

/** The sign-in screen at https://www.saucedemo.com/ */
export class LoginPage {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly error: Locator;
  readonly errorCloseButton: Locator;
  readonly fieldErrorIcons: Locator;

  constructor(readonly page: Page) {
    this.username = page.locator('#user-name');
    this.password = page.locator('#password');
    this.loginButton = page.locator('#login-button');
    this.error = page.locator('[data-test="error"]');
    this.errorCloseButton = page.locator('.error-button');
    this.fieldErrorIcons = page.locator('.error_icon');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(this.loginButton).toBeVisible();
  }

  /** Submit credentials without asserting the outcome - the caller decides. */
  async login(user: string, pw: string = PASSWORD) {
    await this.username.fill(user);
    await this.password.fill(pw);
    await this.loginButton.click();
  }

  /**
   * Sign in and wait for the catalogue. The timeout is generous on purpose:
   * performance_glitch_user is meant to be slow and must not be mistaken for
   * a functional failure.
   */
  async loginExpectingSuccess(user: string, pw: string = PASSWORD) {
    await this.login(user, pw);
    await this.page.waitForURL('**/inventory.html', { timeout: 30_000 });
  }

  async errorText(): Promise<string> {
    return (await this.error.textContent())?.trim() ?? '';
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.loginButton.isVisible().catch(() => false);
  }
}
