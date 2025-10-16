"use client";

import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation("common");

  return (
    <footer className="bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black opacity-90"></div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-3xl font-bold text-brand-primary">
                UYREN.AI
              </h2>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              {t("footer_about")}
            </p>
            <div className="flex space-x-4">
              <div className="p-2 bg-gray-800 rounded-full hover:bg-brand-primary transition-all duration-300 cursor-pointer group">
                <Linkedin className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="p-2 bg-gray-800 rounded-full hover:bg-brand-primary transition-all duration-300 cursor-pointer group">
                <Send className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="p-2 bg-gray-800 rounded-full hover:bg-brand-primary transition-all duration-300 cursor-pointer group">
                <Instagram className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="p-2 bg-gray-800 rounded-full hover:bg-brand-primary transition-all duration-300 cursor-pointer group">
                <Facebook className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
              <div className="p-2 bg-gray-800 rounded-full hover:bg-brand-primary transition-all duration-300 cursor-pointer group">
                <Mail className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-xl mb-6 text-brand-primary">
              {t("footer_quick_links")}
            </h3>
            <div className="space-y-3">
              <Link
                href="/"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_home")}
              </Link>
              <Link
                href="/about"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_about")}
              </Link>
              <Link
                href="/courses"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_courses")}
              </Link>
              {/* <Link
                href="/grants"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_grants")}
              </Link> */}
              {/* <Link
                href="/community"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_community")}
              </Link> */}
              {/* <Link
                href="/sponsorship"
                className="block text-gray-300 hover:text-brand-primary transition-colors duration-300 hover:translate-x-1 transform"
              >
                {t("nav_sponsorship")}
              </Link> */}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-xl mb-6 text-brand-primary">
              {t("footer_contact")}
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 group">
                <div className="p-2 bg-gray-800 rounded-full group-hover:bg-brand-primary transition-colors duration-300">
                  <MapPin className="h-4 w-4 text-brand-primary group-hover:text-white" />
                </div>
                <span className="text-gray-300 text-sm leading-relaxed">
                  {t("footer_address")}
                </span>
              </div>
              <div className="flex items-center space-x-3 group">
                <div className="p-2 bg-gray-800 rounded-full group-hover:bg-brand-primary transition-colors duration-300">
                  <Phone className="h-4 w-4 text-brand-primary group-hover:text-white" />
                </div>
                <span className="text-gray-300 text-sm">+7 777 377 7270</span>
              </div>
              <div className="flex items-center space-x-3 group">
                <div className="p-2 bg-gray-800 rounded-full group-hover:bg-brand-primary transition-colors duration-300">
                  <Mail className="h-4 w-4 text-brand-primary group-hover:text-white" />
                </div>
                <span className="text-gray-300 text-sm">
                  uyrengroup@gmail.com
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-gray-400 text-sm">{t("footer_rights")}</p>
            <p className="text-gray-400 text-sm">{t("footer_tagline")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
