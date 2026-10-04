"use client";

import { Avatar } from "@/components/avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/dropdown";
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
  NavbarSpacer,
} from "@/components/navbar";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronDownIcon,
  Cog8ToothIcon,
  UserIcon,
  EnvelopeIcon,
} from "@heroicons/react/16/solid";
import { BellIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/use-auth";

export function SiteNav() {
  const { user, loading, signOut } = useAuth();
  const isAdmin = !loading && user?.role === "admin";

  return (
    <Navbar>
      {/* Brand logo */}
      <NavbarItem href="/" aria-label="หน้าแรก">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#4a7c59] font-mono text-sm font-bold text-white">
          TR
        </span>
        <NavbarLabel>TOR</NavbarLabel>
      </NavbarItem>

      <NavbarDivider className="max-lg:hidden" />

      {/* Main nav links */}
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/">หน้าแรก</NavbarItem>
        <NavbarItem href="/saved">TOR ที่บันทึกไว้</NavbarItem>
        <NavbarItem href="/reports">รายงาน</NavbarItem>
        {isAdmin && <NavbarItem href="/admin">ผู้ดูแลระบบ</NavbarItem>}
      </NavbarSection>

      <NavbarSpacer />

      {/* Right-side actions */}
      <NavbarSection className="flex items-center gap-2">
        {/* Notification Bell Icon */}
        <NavbarItem
          href="/email-preview"
          aria-label="การแจ้งเตือนและอีเมล"
          title="การแจ้งเตือน & พรีวิวอีเมล"
          className="relative grid size-9 place-items-center rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <BellIcon className="size-5" />
          <span className="absolute top-1.5 right-1.5 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-amber-500"></span>
          </span>
        </NavbarItem>
        {loading ? null : user ? (
          /* ── Logged-in user dropdown ── */
          <Dropdown>
            <DropdownButton as={NavbarItem}>
              <Avatar
                src={user.image ?? null}
                initials={user.name ? user.name[0].toUpperCase() : "U"}
                className="bg-[#4a7c59] text-white"
                square
              />
              <ChevronDownIcon className="size-4 text-zinc-500" />
            </DropdownButton>
            <DropdownMenu className="min-w-56" anchor="bottom end">
              <DropdownItem href="/profile">
                <UserIcon className="size-4" />
                <DropdownLabel>โปรไฟล์ของฉัน</DropdownLabel>
              </DropdownItem>
              <DropdownItem href="/email-preview">
                <EnvelopeIcon className="size-4" />
                <DropdownLabel>พรีวิวอีเมลแจ้งเตือน</DropdownLabel>
              </DropdownItem>
              <DropdownItem href="/settings">
                <Cog8ToothIcon className="size-4" />
                <DropdownLabel>ตั้งค่า</DropdownLabel>
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem onClick={() => void signOut()}>
                <ArrowRightStartOnRectangleIcon className="size-4" />
                <DropdownLabel>ออกจากระบบ</DropdownLabel>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : (
          /* ── Guest — link to login ── */
          <NavbarItem
            href="/auth"
            className="rounded-full bg-primary px-4 py-1.5 font-medium !text-white hover:bg-primary/90"
          >
            เข้าสู่ระบบ
          </NavbarItem>
        )}
      </NavbarSection>
    </Navbar>
  );
}