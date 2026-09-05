export const hotel = {
  name: "Honey Dew Beach Camp",
  shortName: "Honey Dew",
  email: "honeydewbeachcamp@gmail.com",
  phones: [
    { id: "primary", number: "7980841770", display: "79808 41770" },
    { id: "secondary", number: "9830423840", display: "98304 23840" },
  ],
  whatsappEnabled: false as const,
  addressLines: [
    "Honey Dew Beach Camp",
    "Narayan Pally",
    "Village + P.O. Baliara",
    "Mousuni Island",
    "PIN 743357",
  ],
  localityLabel: "Mousuni Island",
  district: "South 24 Parganas, West Bengal, India",
  mapsUrl: "https://maps.app.goo.gl/n6SSoSkVGENUrvG8A",
  supportHours: "8:00 AM – 10:00 PM IST, all days",
  responseNote: "Calls are answered during support hours. Email is answered within two business days.",
  checkInTime: "11:00",
  checkOutTime: "10:00",
  timezone: "Asia/Kolkata" as const,
  currency: "INR" as const,
  idProof:
    "Valid ID proof is required for all guests. Aadhaar is preferred by the property.",
};
