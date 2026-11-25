import { MENTIS_CONTACT_PHONE_DISPLAY, MENTIS_CONTACT_PHONE_TEL } from "@/lib/mentis-coming-soon/config";
import styles from "./coming-soon.module.css";

// Interim contact until the service launches. Tapping the number dials on mobile.
export function ContactLine() {
  return (
    <footer className={styles.contact}>
      <span>Questions or enquiries? Call</span>{" "}
      <a href={`tel:${MENTIS_CONTACT_PHONE_TEL}`} className={styles.contactLink}>
        {MENTIS_CONTACT_PHONE_DISPLAY}
      </a>
    </footer>
  );
}
