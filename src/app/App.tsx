import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ApiError } from '../lib/api/client'
import { AppLayout } from '../components/layout/AppLayout'
import { AdminPage } from '../features/admin/AdminPage'
import { SocietesAdminPage } from '../features/admin/SocietesAdminPage'
import { AuditJournalPage } from '../features/admin/AuditJournalPage'
import { StatsGlobalesPage } from '../features/admin/StatsGlobalesPage'
import { AssistantIaPage } from '../features/admin/AssistantIaPage'
import { DocumentsPage } from '../features/admin/DocumentsPage'
import { GestionAccesPage } from '../features/admin/GestionAcces'
import { PermissionsAdminPage } from '../features/admin/PermissionsAdminPage'
import { UsersAdminPage } from '../features/admin/UsersAdminPage'
import { ReportsAdminPage } from '../features/admin/ReportsAdminPage'
import { DepartementsAdminPage } from '../features/admin/DepartementsAdminPage'
import { ForgotPasswordPage, LoginPage } from '../features/auth/LoginPage'
import { FirstLoginPage } from '../features/auth/FirstLoginPage'
import { SetupPasswordPage } from '../features/auth/SetupPasswordPage'
import { AccountPage } from '../features/auth/AccountPage'
import { ColisNaNgaPage } from '../features/colisnanga/ColisNaNgaPage'
import { DirectionDashboardPage } from '../features/dashboard-direction/DirectionDashboardPage'
import { FinancePage } from '../features/finance/FinancePage'
import { HrPage, PayrollPage } from '../features/hr/HrPage'
import { MdrPage } from '../features/mindsetduroyaume/MdrPage'
import {
  B2cPage,
  CompliancePage,
  CouriersPage,
  EnterprisesPage,
  FleetMapPage,
  IncidentsPage,
  InvoicingPage,
  LeavesPage,
  MarketingPage,
  MediaLibraryPage,
  MonitoringPage,
  PartnersPage,
  SubscriptionsPage,
} from '../features/ops/OpsModules'
import { HomePage } from '../features/projects/HomePage'
import { TicketDetailPage } from '../features/tickets/TicketDetailPage'
import { TechTicketsPage, TicketsPage } from '../features/tickets/TicketsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false
        return count < 1
      },
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<LoginPage />} />
          <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
          <Route path="/premiere-connexion" element={<FirstLoginPage />} />
          <Route path="/definir-mot-de-passe" element={<SetupPasswordPage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/tickets-techniques" element={<TechTicketsPage />} />
            <Route path="/technique/bugs" element={<TechTicketsPage />} />
            <Route path="/direction" element={<DirectionDashboardPage />} />
            <Route path="/rh" element={<HrPage />} />
            <Route path="/rh/agents" element={<UsersAdminPage />} />
            <Route path="/rh/conges" element={<LeavesPage />} />
            <Route path="/rh/paie" element={<PayrollPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/finance/abonnements" element={<SubscriptionsPage />} />
            <Route path="/finance/facturation" element={<InvoicingPage />} />
            <Route path="/finance/b2c" element={<B2cPage />} />
            <Route path="/commercial" element={<EnterprisesPage />} />
            <Route path="/commercial/coursiers" element={<CouriersPage />} />
            <Route path="/commercial/entreprises" element={<EnterprisesPage />} />
            <Route path="/operations/flotte" element={<FleetMapPage />} />
            <Route path="/operations/incidents" element={<IncidentsPage />} />
            <Route path="/juridique/partenaires" element={<PartnersPage />} />
            <Route path="/juridique/conformite" element={<CompliancePage />} />
            <Route path="/marketing/performance" element={<MarketingPage />} />
            <Route path="/marketing/mediatheque" element={<MediaLibraryPage />} />
            <Route path="/technique/monitoring" element={<MonitoringPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/compte" element={<AccountPage />} />
            <Route path="/supervision/operations" element={<ColisNaNgaPage />} />
            <Route path="/supervision/cnn" element={<Navigate to="/supervision/operations" replace />} />
            <Route path="/supervision/mdr" element={<MdrPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/societes" element={<SocietesAdminPage />} />
            <Route path="/admin/utilisateurs" element={<UsersAdminPage />} />
            <Route path="/admin/departements" element={<DepartementsAdminPage />} />
            <Route path="/admin/acces" element={<GestionAccesPage />} />
            <Route path="/admin/permissions" element={<PermissionsAdminPage />} />
            <Route path="/admin/audit" element={<AuditJournalPage />} />
            <Route path="/admin/rapports" element={<ReportsAdminPage />} />
            <Route path="/admin/assistant-ia" element={<AssistantIaPage />} />
            <Route path="/admin/statistiques" element={<StatsGlobalesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
