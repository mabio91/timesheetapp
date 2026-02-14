import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.bar.fill") }

            EngagementListView()
                .tabItem { Label("Incarichi", systemImage: "briefcase.fill") }

            CalendarMonthView()
                .tabItem { Label("Calendario", systemImage: "calendar") }

            WorkdayListView()
                .tabItem { Label("Giornate", systemImage: "list.bullet.rectangle") }

            AuditView()
                .tabItem { Label("Audit", systemImage: "clock.arrow.circlepath") }
        }
    }
}
