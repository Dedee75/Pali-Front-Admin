"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileNavigation.module.css";

export default function MobileNavigation() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const teacher = pathname.startsWith("/teacher");
  const links = teacher
    ? [["/teacher/teacher-dashboard", "Dashboard"], ["/teacher/student", "Students"]]
    : [["/admin/admin", "Users"], ["/admin/batches", "Batches"], ["/admin/homeworks", "Homework"], ["/admin/students", "Students"]];

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)");
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label="Open navigation menu" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    <dialog ref={dialog} className={styles.drawer} aria-label="Navigation menu" onClose={() => trigger.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX > box.right || event.clientY > box.bottom) event.currentTarget.close(); } }}>
      <div className={styles.heading}><strong>Dhamma {teacher ? "Teacher" : "Admin"}</strong><button type="button" aria-label="Close navigation menu" onClick={() => dialog.current?.close()}>×</button></div>
      <nav aria-label="Main navigation">{links.map(([href, label]) => {
        const active = pathname === href || (href === "/admin/homeworks" && pathname === "/admin/homework-list");
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.active : styles.link} onClick={() => dialog.current?.close()}>{label}</Link>;
      })}</nav>
    </dialog>
  </>;
}
