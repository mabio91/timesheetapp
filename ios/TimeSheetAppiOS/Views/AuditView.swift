import SwiftUI

struct AuditView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List(store.audit) { event in
                VStack(alignment: .leading, spacing: 4) {
                    Text(event.message).font(.subheadline.bold())
                    Text(event.entity).font(.caption)
                    Text(event.date, format: .dateTime.day().month().year().hour().minute())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Audit")
        }
    }
}
