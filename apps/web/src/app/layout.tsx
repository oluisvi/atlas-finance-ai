import type {Metadata} from "next";import "./globals.css";import {Providers} from "@/components/providers";
export const metadata:Metadata={title:"Atlas Finance",description:"Gestão financeira confiável"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><Providers>{children}</Providers></body></html>}

