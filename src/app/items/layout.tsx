import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import React from "react";

export default async function ItemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const session = await auth.api.getSession({
    headers: await import("next/headers").then((h) => h.headers()),
  });


  if (!session) {
    redirect("/login?callbackUrl=/items/add");
    // If the user is not logged in, redirect them to the login page with a callback URL to return to the add item page after login.
  }

  // If the user is logged in, render the children components (the content of the items pages).
  return <>{children}</>;
}