import Foundation

enum EngagementStatus: String, Codable, CaseIterable, Identifiable {
    case active, closed, suspended
    var id: String { rawValue }
}

enum WorkdayStatus: String, Codable, CaseIterable, Identifiable {
    case worked = "worked"
    case nonWorked = "non-worked"
    case blocked = "blocked"
    case holiday = "holiday"
    case weekend = "weekend"

    var id: String { rawValue }
}

struct Engagement: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var title: String
    var clientName: String
    var subject: String = ""
    var startDate: Date
    var endDate: Date
    var dailyRate: Double
    var maxBillableDays: Int?
    var weekendAllowed: Bool = false
    var holidaysAllowed: Bool = false
    var status: EngagementStatus = .active
}

struct Workday: Identifiable, Codable, Equatable {
    var id: UUID = UUID()
    var engagementID: UUID
    var date: Date
    var status: WorkdayStatus
    var fatturabile: Bool
    var activities: [String] = []
    var internalNote: String = ""
}

struct AuditEvent: Identifiable, Codable {
    var id: UUID = UUID()
    var date: Date = Date()
    var entity: String
    var message: String
}

struct AppSnapshot: Codable {
    var engagements: [Engagement]
    var workdays: [Workday]
    var audit: [AuditEvent]
}
