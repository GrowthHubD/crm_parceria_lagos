import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numerico como moeda BRL.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Mascara CNPJ: exibe apenas os ultimos digitos para seguranca.
 */
export function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `**.***.***/${digits.slice(-6, -2)}-${digits.slice(-2)}`;
}

/**
 * Mascara telefone: exibe apenas os ultimos 4 digitos.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `(**) *****-${digits.slice(-4)}`;
}
