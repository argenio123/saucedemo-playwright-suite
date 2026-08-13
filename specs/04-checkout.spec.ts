import { test, expect } from '../fixtures/test';
import { CHECKOUT_CUSTOMER, expectedTax, money, priceOf } from '../data/products';
import { note, defect } from '../utils/report';

/**
 * Checkout: field validation, arithmetic and order completion.
 * Covers TC-037 to TC-048.
 */
test.describe('Checkout', () => {

  /** Put one known item in the cart and stop on the information step. */
  async function startCheckout(shopper: any, cartPage: any, product = 'Sauce Labs Backpack') {
    await shopper.addToCart(product);
    await shopper.openCart();
    await cartPage.checkout();
  }

  test('TC-037 The first name is required', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);

    await checkoutPage.fillInformation('', CHECKOUT_CUSTOMER.lastName, CHECKOUT_CUSTOMER.postalCode);
    await checkoutPage.submitInformation();

    await expect(checkoutPage.error).toHaveText('Error: First Name is required');
    await expect(checkoutPage.page).toHaveURL(/checkout-step-one\.html/);

    note(testInfo, 'Submitting the checkout form with an empty First Name was blocked with "Error: First Name is required" and the journey stayed on the information step.');
  });

  test('TC-038 The last name is required', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);

    await checkoutPage.fillInformation(CHECKOUT_CUSTOMER.firstName, '', CHECKOUT_CUSTOMER.postalCode);
    await checkoutPage.submitInformation();

    await expect(checkoutPage.error).toHaveText('Error: Last Name is required');
    note(testInfo, 'Submitting with an empty Last Name was blocked with "Error: Last Name is required" and the order did not advance to the overview.');
  });

  test('TC-039 The postal code is required', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);

    await checkoutPage.fillInformation(CHECKOUT_CUSTOMER.firstName, CHECKOUT_CUSTOMER.lastName, '');
    await checkoutPage.submitInformation();

    await expect(checkoutPage.error).toHaveText('Error: Postal Code is required');
    note(testInfo, 'Submitting with an empty Postal Code was blocked with "Error: Postal Code is required". All three fields are therefore enforced independently.');
  });

  test('TC-040 Valid customer information advances to the order overview', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);
    await checkoutPage.proceedToOverview();

    await expect(checkoutPage.page).toHaveURL(/checkout-step-two\.html/);
    await expect(checkoutPage.title).toHaveText('Checkout: Overview');
    await expect(checkoutPage.finishButton).toBeVisible();

    note(testInfo, `Valid details (${CHECKOUT_CUSTOMER.firstName} ${CHECKOUT_CUSTOMER.lastName}, ${CHECKOUT_CUSTOMER.postalCode}) advanced the journey to "Checkout: Overview" with the Finish control available.`);
  });

  test('TC-041 Cancel on the information step returns to the cart', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);
    await checkoutPage.cancelButton.click();

    await cartPage.expectLoaded();
    await expect(cartPage.items).toHaveCount(1);

    note(testInfo, 'Cancelling the information step returned to the cart with the single selected item still present, so abandoning checkout does not discard the basket.');
  });

  test('TC-042 The overview lists exactly the products being purchased', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    const chosen = ['Sauce Labs Backpack', 'Sauce Labs Bike Light'];
    for (const name of chosen) await shopper.addToCart(name);
    await shopper.openCart();
    await cartPage.checkout();
    await checkoutPage.proceedToOverview();

    const listed = await checkoutPage.overviewNames();
    expect(listed.sort()).toEqual([...chosen].sort());

    note(testInfo, `The overview step listed exactly the two products carried from the cart with nothing added or dropped: ${listed.join(', ')}.`);
  });

  test('TC-043 The item total equals the sum of the line prices', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    const chosen = ['Sauce Labs Backpack', 'Sauce Labs Bike Light', 'Sauce Labs Onesie'];
    for (const name of chosen) await shopper.addToCart(name);
    await shopper.openCart();
    await cartPage.checkout();
    await checkoutPage.proceedToOverview();

    const expectedSubtotal = money(chosen.reduce((sum, name) => sum + priceOf(name), 0));
    const shownSubtotal = await checkoutPage.itemTotal();

    expect(shownSubtotal).toBe(expectedSubtotal);
    note(testInfo, `Item total reconciled: ${chosen.map(n => `$${priceOf(n).toFixed(2)}`).join(' + ')} = $${expectedSubtotal.toFixed(2)}, which is what the overview displayed.`);
  });

  test('TC-044 Tax is 8 percent of the item total', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage, 'Sauce Labs Backpack');
    await checkoutPage.proceedToOverview();

    const subtotal = await checkoutPage.itemTotal();
    const shownTax = await checkoutPage.tax();
    const computed = expectedTax(subtotal);

    expect(shownTax).toBeCloseTo(computed, 2);
    note(testInfo, `Tax reconciled against the published 8 percent rate: $${subtotal.toFixed(2)} x 0.08 = $${computed.toFixed(2)}, and the overview displayed $${shownTax.toFixed(2)}.`);
  });

  test('TC-045 The order total equals the item total plus tax', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    const chosen = ['Sauce Labs Fleece Jacket', 'Sauce Labs Bolt T-Shirt'];
    for (const name of chosen) await shopper.addToCart(name);
    await shopper.openCart();
    await cartPage.checkout();
    await checkoutPage.proceedToOverview();

    const subtotal = await checkoutPage.itemTotal();
    const tax = await checkoutPage.tax();
    const total = await checkoutPage.total();

    expect(money(subtotal + tax)).toBe(money(total));
    note(testInfo, `The three money figures were internally consistent: item total $${subtotal.toFixed(2)} plus tax $${tax.toFixed(2)} equals the displayed total of $${total.toFixed(2)}.`);
  });

  test('TC-046 Finishing the order shows the confirmation', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);
    await checkoutPage.proceedToOverview();
    await checkoutPage.finish();

    await checkoutPage.expectOrderConfirmed();
    await expect(checkoutPage.completeText).toContainText(/dispatched/i);

    note(testInfo, 'Completing the order navigated to /checkout-complete.html and displayed the "Thank you for your order!" confirmation together with the dispatch message.');
  });

  test('TC-047 Back Home returns to the catalogue with an emptied cart', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    await startCheckout(shopper, cartPage);
    await checkoutPage.proceedToOverview();
    await checkoutPage.finish();
    await checkoutPage.backHome();

    await shopper.expectLoaded();
    await expect(shopper.cartBadge).toHaveCount(0);

    note(testInfo, 'After a completed purchase, "Back Home" returned to the catalogue and the cart had been emptied - the badge was absent, so the basket did not survive the order.');
  });

  test('TC-048 Checkout is refused with an empty cart', async ({ shopper, cartPage, checkoutPage }, testInfo) => {
    // Business-rule probe. An empty order has no legitimate meaning, so this
    // asserts the rule rather than the implementation.
    await shopper.openCart();
    await expect(cartPage.items).toHaveCount(0);

    await cartPage.checkoutButton.click();
    await checkoutPage.fillInformation();
    await checkoutPage.submitInformation();

    const reachedOverview = checkoutPage.page.url().includes('checkout-step-two');

    if (!reachedOverview) {
      note(testInfo, 'An empty cart could not be taken through checkout - the journey was stopped before the order overview.');
    } else {
      const total = await checkoutPage.total().catch(() => 0);
      note(testInfo, `DEFECT: an empty cart was accepted through checkout. The overview rendered with no line items and a total of $${total.toFixed(2)}, and the Finish control was available, so a zero-value order can be placed.`);
      defect(testInfo, 'DEF-SD-003', 'No guard prevents checkout from an empty cart. Raise with the BA - an empty order has no business meaning.');
    }

    expect.soft(reachedOverview, 'an empty cart must not reach the order overview').toBeFalsy();
  });
});
