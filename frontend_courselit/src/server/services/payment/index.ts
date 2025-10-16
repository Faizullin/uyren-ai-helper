import { internal } from "@/config/strings";
import { Domain } from "@/models/Domain";
import { UIConstants } from "@workspace/common-models";
import StripePayment from "./stripe-payment";

export const getPaymentMethodFromSettings = async (
  siteInfo: Domain["settings"] | null,
  name?: string,
) => {
  if (!siteInfo || !siteInfo.paymentMethod) {
    return null;
  }

  switch (name || siteInfo.paymentMethod) {
    case UIConstants.PAYMENT_METHOD_PAYPAL:
      throw new Error(internal.error_payment_method_not_implemented);
    case UIConstants.PAYMENT_METHOD_STRIPE:
      return await new StripePayment(siteInfo).setup();
    // case UIConstants.PAYMENT_METHOD_RAZORPAY:
    //   return await new RazorpayPayment(siteInfo).setup();
    // case UIConstants.PAYMENT_METHOD_LEMONSQUEEZY:
    //   return await new LemonSqueezyPayment(siteInfo).setup();
    // case UIConstants.PAYMENT_METHOD_PAYTM:
    //   throw new Error(notYetSupported);
    default:
      throw new Error(internal.error_unrecognised_payment_method);
  }
};
