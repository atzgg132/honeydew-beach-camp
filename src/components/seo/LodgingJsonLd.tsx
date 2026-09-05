import { hotel } from "@/data/hotel";
import { siteUrl } from "@/lib/site";

export function LodgingJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: hotel.name,
    url: siteUrl,
    email: hotel.email,
    priceRange: "₹999 - ₹1,499 per person per night",
    telephone: hotel.phones.map((phone) => `+91${phone.number}`),
    address: {
      "@type": "PostalAddress",
      streetAddress: "Narayan Pally, Village + P.O. Baliara",
      addressLocality: "Mousuni Island",
      postalCode: "743357",
      addressCountry: "IN",
    },
    currenciesAccepted: hotel.currency,
    checkinTime: "11:00",
    checkoutTime: "10:00",
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Meals included",
        value: true,
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
