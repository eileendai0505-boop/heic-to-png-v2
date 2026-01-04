import "@/app/globals.css";

import { MdOutlineHome } from "react-icons/md";
import { Metadata } from "next";
import React from "react";
import { getTranslations } from "next-intl/server";
import LegalHeader from "@/components/legal-header";
import Footer from "@/components/blocks/footer";
import { Footer as FooterType } from "@/types/blocks/footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();

  return {
    title: {
      template: `%s | ${t("metadata.title")}`,
      default: t("metadata.title"),
    },
    description: t("metadata.description"),
    keywords: t("metadata.keywords"),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_WEB_URL || "https://heictopng.org"
    ),
    alternates: {
      canonical: "./",
    },
  };
}

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const footer: FooterType = {
    name: "footer",
    brand: {
      title: "HeicToPng",
      description: "Convert HEIC images to PNG quickly and securely, directly in your browser. No uploads, no sign-ups, and no data leaves your device. Built for speed, privacy, and high-quality image conversion.",
      logo: {
        src: "/logo.png",
        alt: "HeicToPng"
      },
      url: "/"
    },
    copyright: "© 2025 • HeicToPng.org All rights reserved.",
    nav: {
      items: []
    },
    social: {
      items: []
    },
    agreement: {
      items: [
        {
          title: "Privacy Policy",
          url: "/privacy-policy"
        },
        {
          title: "Terms of Service",
          url: "/terms-of-service"
        },
        {
          title: "Email",
          icon: "RiMailLine",
          url: "mailto:support@heictopng.org"
        }
      ]
    }
  };

  return (
    <div>
      <LegalHeader />
      <a
        className="text-base-content cursor-pointer hover:opacity-80 transition-opacity"
        href="/"
      >
        <MdOutlineHome className="text-2xl mx-8 my-8" />
        {/* <img className="w-10 h-10 mx-4 my-4" src="/logo.png" /> */}
      </a>
      <div className="text-md max-w-4xl mx-auto pt-4 pb-16 px-8 prose prose-slate dark:prose-invert
        prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-4
        prose-h1:text-3xl prose-h1:mt-0 prose-h1:mb-6
        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-5
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-p:mb-5 prose-p:leading-7
        prose-ul:mb-6 prose-ul:mt-4
        prose-li:mb-2
        prose-a:text-primary hover:prose-a:text-primary/80
        prose-strong:text-base-content
        prose-code:text-base-content prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md">
        {children}
      </div>
      <Footer footer={footer} />
    </div>
  );
}
