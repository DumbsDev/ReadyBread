// src/pages/earningdisclaimer.tsx
import React from "react";

export const EarningsDisclaimer: React.FC = () => {
  return (
    <main className="rb-content rb-legal-page">
      <h1>ReadyBread Earnings Disclaimer</h1>

      <p>
        ReadyBread provides access to surveys, games, offers, tasks, and
        affiliate links from third-party partners. Individual earnings vary and
        are not guaranteed.
      </p>

      <h2>1. No Guaranteed Earnings</h2>
      <p>
        Earnings depend on offer availability, partner approval, user location,
        device type, survey quality, fraud checks, and account behavior.
      </p>

      <h2>2. Partner Control</h2>
      <p>Offerwall partners (such as BitLabs) may:</p>
      <ul>
        <li>Approve rewards</li>
        <li>Reverse or deny completions</li>
        <li>Change payout values</li>
        <li>Flag activity as fraudulent</li>
      </ul>

      <h2>3. Balance Is Not Cash</h2>
      <p>
        Your ReadyBread balance is not real money until manually reviewed and
        approved for payout. Reversed or denied offers may affect balance.
      </p>

      <p>
        If an account is permanently banned for fraud, its balance will be set
        to $0 and cannot be withdrawn.
      </p>

      <h2>4. Fraud Prevention</h2>
      <p>Rewards may be denied or reversed due to:</p>
      <ul>
        <li>Multi-accounting</li>
        <li>VPN or proxy use may reduce offer availability</li>
        <li>Low-quality answers</li>
        <li>Automated behavior</li>
        <li>Partner fraud flags</li>
      </ul>

      <h2>5. Charity Withdrawal Policy</h2>
      <p>
        If you choose to withdraw to a charity, ReadyBread will donate an
        additional 5%. Donations are made under ReadyBread’s name and cannot be
        written off by the user.
      </p>

      <h2>TL;DR Summary</h2>
      <ul>
        <li>Earnings are not guaranteed.</li>
        <li>Partners approve or deny rewards.</li>
        <li>Your balance is not cash until manually paid.</li>
        <li>Fraud checks affect payouts.</li>
      </ul>
    </main>
  );
};
