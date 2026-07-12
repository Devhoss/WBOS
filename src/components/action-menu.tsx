"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type MenuItem = {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
};

export function ActionMenu({ items }: { items: MenuItem[] }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function close() {
      setIsOpen(false);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current || !buttonRef.current) return;
    const actual = menuRef.current.getBoundingClientRect();
    const btnRect = buttonRef.current.getBoundingClientRect();

    const GAP = 6;
    const VIEWPORT_PADDING = 12;

    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(btnRect.right - actual.width, window.innerWidth - actual.width - VIEWPORT_PADDING),
    );

    const openAbove = btnRect.bottom + GAP + actual.height > window.innerHeight - VIEWPORT_PADDING;
    const top = openAbove ? btnRect.top - actual.height - GAP : btnRect.bottom + GAP;

    setPosition({ top, left });
  }, [isOpen]);

  function toggleMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setPosition({ top: rect.bottom + 6, left: Math.max(12, rect.right - 144) });
    setIsOpen((c) => !c);
  }

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className="fixed z-[9999] rounded-md border bg-background p-1 text-left shadow-lg"
      style={{ left: position.left, top: position.top }}
      onClick={() => setIsOpen(false)}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`block w-full rounded px-3 py-2 text-left text-sm whitespace-nowrap transition hover:bg-muted ${item.variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`}
          type="button"
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:text-foreground"
        type="button"
        onClick={toggleMenu}
      >
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Actions</span>
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
