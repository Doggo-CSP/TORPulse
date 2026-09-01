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
} from "@heroicons/react/16/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { useAuth } from "@/hooks/use-auth";

export function SiteNav() {
  const { user, loading, signOut } = useAuth();

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
        <NavbarItem href="/profile">โปรไฟล์</NavbarItem>
        <NavbarItem href="/admin">ผู้ดูแลระบบ</NavbarItem>
      </NavbarSection>

      <NavbarSpacer />

      {/* Right-side actions */}
      <NavbarSection>
        <NavbarItem href="/search" aria-label="ค้นหา">
          <MagnifyingGlassIcon className="size-5" />
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
