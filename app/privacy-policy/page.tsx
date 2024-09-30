import PolicyRow from "@/components/ui/policy-row"

export default function PrivacyPolicy() {
  return (
    <section className="text-md space-y-12 pb-4 text-muted-foreground md:pb-8 md:text-lg">
      <h1 className="text-center text-3xl">
        <b>ConvertEase</b> - Privacy Policy
      </h1>
      <p>Effective Date: Mon 30 Sep 2024</p>
      At <b>ConvertEase</b>, your privacy is our priority. This Privacy Policy
      explains how we collect, use, and protect your personal information when
      you interact with our website and services. We encourage you to read this
      policy thoroughly to understand how we handle your data.
      {/* 1 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          1. Information We Collect
        </h2>
        <p>
          At <b>ConvertEase</b>, we collect minimal data to optimize your
          experience. Specifically, we gather information via Google Analytics,
          including:
        </p>
        <ul className="pl-5">
          <li>
            <b>Usage Information:</b> This includes details about your
            interaction with our website, such as pages visited, your IP
            address, browser type, device type, and referral URLs. We use this
            data to enhance the functionality and content of our website,
            ensuring a seamless user experience.
          </li>
        </ul>
      </div>
      {/* 2 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          2. How We Use Your Information
        </h2>
        <p>
          The data collected via Google Analytics is solely used to analyze user
          behavior and improve our website&apos;s performance. We do not sell,
          rent, or share your information with any third parties.
        </p>
      </div>
      {/* 3 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          3. Cookies and Tracking Technologies
        </h2>
        <p>
          We use cookies and similar technologies to store information about
          your interactions with our site. You can manage or disable cookies via
          your browser settings. However, disabling cookies may limit some
          features or functionality on our website.
        </p>
      </div>
      {/* 4 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          4. Data Security
        </h2>
        <p>
          We implement industry-standard security measures to protect your
          personal data from unauthorized access, alteration, disclosure, or
          destruction. Despite these efforts, no method of internet transmission
          or electronic storage is entirely secure. We urge you to understand
          that while we strive to protect your data, we cannot guarantee
          complete security.
        </p>
      </div>
      {/* 5 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          5. Third-Party Links
        </h2>
        <p>
          Our website may contain links to external websites or services that we
          do not control. <b>ConvertEase</b> is not responsible for the privacy
          practices or content of these third-party websites. We recommend
          reviewing the privacy policies of any external websites you visit
          before sharing your personal information.
        </p>
      </div>
      {/* 6 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          6. Children’s Privacy
        </h2>
        <p>
          Our services are not intended for individuals under the age of 13. We
          do not knowingly collect personal information from children. If you
          are a parent or guardian and believe your child has provided us with
          personal data, please contact us immediately. We will take steps to
          delete that information.
        </p>
      </div>
      {/* 7 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          7. Updates to This Privacy Policy
        </h2>
        <p>
          We reserve the right to update this Privacy Policy at any time.
          Changes will take effect immediately upon posting the updated policy
          on this page, and the &ldquo;Effective Date&ldquo; at the top will
          reflect the most recent revision. We encourage you to review this page
          regularly for any updates.
        </p>
      </div>
      {/* 8 */}
      <div className="space-y-2">
        <h2 className="text-xl font-medium text-muted-foreground md:text-2xl">
          8. Contact Us
        </h2>
        <p>
          If you have any questions, concerns, or feedback regarding this
          Privacy Policy or how we handle your data, please contact us at:
          support@convertease.com.
          <br />
          By using <b>ConvertEase</b>, you agree to the terms outlined in this
          Privacy Policy. If you do not agree with any part of this policy,
          please discontinue use of our services.
          <br />
          Thank you for trusting <b>ConvertEase</b> to protect your privacy.
        </p>
      </div>
    </section>
  )
}
