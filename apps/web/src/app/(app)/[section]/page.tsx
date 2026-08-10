"use client";
import { notFound, useParams } from "next/navigation";
import { ResourcePage, configs } from "@/components/resource-page";
import { FinancialHealth, ImportsPage, Reports, SettingsPage } from "@/components/special-pages";
export default function Page(){const {section}=useParams<{section:string}>();if(section==="financial-health")return <FinancialHealth/>;if(section==="reports")return <Reports/>;if(section==="settings")return <SettingsPage/>;if(section==="imports")return <ImportsPage/>;if(configs[section])return <ResourcePage kind={section}/>;notFound()}
