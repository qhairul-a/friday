"use client";
import { useState } from "react";

export function useFinancePrivacy() {
  const [show, setShow] = useState(false);

  function toggle() {
    setShow((prev) => !prev);
  }

  return { show, toggle };
}
