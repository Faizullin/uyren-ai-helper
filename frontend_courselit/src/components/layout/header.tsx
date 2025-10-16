"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { useSiteInfo } from "@/components/contexts/site-info-context";
import { useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/utils";
import {
  LogOut,
  Menu,
  Settings,
  UserCircle,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ThemeToggle from "./theme-toggle";

export default function Header() {
  const { t, i18n } = useTranslation(["common", "dashboard"]);
  const { siteInfo } = useSiteInfo();
  const { profile } = useProfile();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [currentLang, setCurrentLang] = useState(i18n.language || "en");

  const navigationItems = [
    { name: t("nav_home"), href: "/" },
    { name: t("nav_about"), href: "/about" },
    { name: t("nav_courses"), href: "/courses" },
    { name: t("nav_grants"), href: "/grants" },
    // { name: t("nav_sponsorship"), href: "/sponsorship" },
  ];

  const languages = [
    { code: "en-US", label: "EN" },
    { code: "ru", label: "RU" },
    { code: "kz", label: "KZ" },
  ];

  const handleNavigation = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (href === pathname) return;
    router.push(href);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setCurrentLang(lng);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle click outside to close user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: "/" });
      toast({
        title: t("common:dashboard.success"),
        description: t("dashboard:header.signed_out_successfully"),
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: t("common:dashboard.error"),
        description: t("dashboard:header.sign_out_error"),
        variant: "destructive",
      });
    }
    setUserMenuOpen(false);
  };

  const isAuthenticated = status === "authenticated" && session?.user;

  return (
    <header className="bg-background shadow-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Branding
            title={siteInfo?.title || "Uyren Academy"}
            subtitle={siteInfo?.subtitle}
            icon={
              <Image
                src={siteInfo?.logo?.url || "/img/logo.svg"}
                alt={siteInfo?.logo?.caption || siteInfo?.title || t("dashboard:header.logo")}
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = "/img/logo.svg";
                }}
              />
            }
            onClick={handleNavigation}
          />

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4 lg:space-x-8">
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => handleNavigation(item.href, e)}
                  className={cn(
                    "relative py-2 px-1 text-gray-700 dark:text-gray-200 text-sm transition-all duration-300 hover:text-brand-primary group",
                    isActive ? "font-bold text-brand-primary" : "font-medium",
                  )}
                >
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-primary transform transition-transform duration-300" />
                  )}
                  {!isActive && (
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-primary transform transition-all duration-300 group-hover:w-full" />
                  )}
                </Link>
              );
            })}

            {/* Language selector */}
            <Select value={currentLang} onValueChange={changeLanguage}>
              <SelectTrigger className="w-20 h-9 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Get Started */}
            {!isAuthenticated ? (
              <Link
                href="/auth/sign-in"
                onClick={(e) => handleNavigation("/auth/sign-in", e)}
              >
                <Button className="bg-brand-primary hover:bg-brand-primary-hover text-white px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-105">
                  {t("nav_get_started")}
                </Button>
              </Link>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="p-2 rounded-md text-muted-foreground hover:text-brand-primary hover:bg-accent transition-colors duration-200"
                  aria-label={profile?.fullName || t("dashboard:header.user")}
                >
                  {profile?.avatar?.file ? (
                    <Image
                      src={profile.avatar.file}
                      alt={profile.fullName || t("dashboard:header.user_avatar")}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-8 h-8 text-brand-primary" />
                  )}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-md shadow-lg py-1 z-50">
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-muted-foreground hover:text-brand-primary hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 inline mr-2" />
                      {t("common:dashboard.dashboard")}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-red-500 hover:bg-accent"
                    >
                      <LogOut className="w-4 h-4 inline mr-2" />
                      {t("dashboard:header.sign_out")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden focus:outline-none"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t("dashboard:header.close_menu") : t("dashboard:header.open_menu")}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 transition-transform duration-300 rotate-90" />
            ) : (
              <Menu className="h-6 w-6 transition-transform duration-300" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <div
          className={cn(
            "lg:hidden border-t overflow-hidden transition-all duration-300 ease-in-out",
            mobileMenuOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="flex flex-col space-y-2 py-4">
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => handleNavigation(item.href, e)}
                  className={cn(
                    "block py-2 px-2 transition-all duration-200 rounded-md",
                    isActive
                      ? "text-brand-primary font-bold bg-orange-50 border-l-4 border-brand-primary pl-4"
                      : "text-gray-700 dark:text-gray-200 hover:text-brand-primary hover:bg-orange-50/50 dark:hover:bg-orange-900/20 font-medium",
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="flex items-center justify-between py-2 px-2">
              <span className="text-gray-700 dark:text-gray-200 font-medium">{t("nav_theme")}</span>
              <ThemeToggle />
            </div>

            {/* Mobile language selector */}
            <div className="flex items-center justify-between py-2 px-2">
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {t("nav_language")}
              </span>
              <Select value={currentLang} onValueChange={changeLanguage}>
                <SelectTrigger className="w-20 h-9 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isAuthenticated ? (
              <Link
                href="/auth/sign-in"
                onClick={(e) => handleNavigation("/auth/sign-in", e)}
              >
                <Button className="w-full mt-4 bg-brand-primary hover:bg-brand-primary-hover text-white py-2 rounded-lg font-medium transition-all duration-300">
                  {t("nav_get_started")}
                </Button>
              </Link>
            ) : (
              <Link
                href="/dashboard"
                onClick={(e) => handleNavigation("/dashboard", e)}
              >
                <Button className="w-full mt-4 bg-brand-primary hover:bg-brand-primary-hover text-white py-2 rounded-lg font-medium transition-all duration-300">
                  {t("nav_dashboard")}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

const Branding = (props: {
  onClick: (href: string, e: React.MouseEvent) => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
}) => {
  return (
    <Link
      href="/"
      className="flex items-center space-x-3 group transition-all duration-300"
      onClick={(e) => props.onClick("/", e)}
    >
      <div className="w-10 h-10 flex items-center justify-center transition-transform duration-300">
        {props.icon}
      </div>
      <div>
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{props.title}</div>
        <div className="text-xs text-brand-primary">{props.subtitle}</div>
      </div>
    </Link>
  );
};
