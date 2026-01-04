"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function LegalHeader() {
  const navItems = [
    { title: "Features", url: "/#feature" },
    { title: "Blog", url: "/posts" },
  ];

  return (
    <section className="py-3 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 border-b">
      <div className="container">
        {/* Desktop Navigation */}
        <nav className="hidden justify-between lg:flex">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="HeicToPng" className="w-8" />
              <span className="text-xl text-primary font-bold">HeicToPng</span>
            </Link>
            <div className="flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.url}
                  href={item.url}
                  className="text-muted-foreground hover:text-primary px-4 py-2 rounded-md hover:bg-accent transition-colors"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Mobile Navigation */}
        <div className="block lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="HeicToPng" className="w-8" />
              <span className="text-xl font-bold">HeicToPng</span>
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="default" size="icon">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>
                    <Link href="/" className="flex items-center gap-2">
                      <img src="/logo.png" alt="HeicToPng" className="w-8" />
                      <span className="text-xl font-bold">HeicToPng</span>
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-8 flex flex-col gap-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.url}
                      href={item.url}
                      className="font-semibold px-4 py-2 hover:bg-accent rounded-md transition-colors"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </section>
  );
}
