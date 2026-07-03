import { ActivityLogRepository, type CreateActivityLogInput } from "../repositories/activity-log-repository";

export class ActivityLogService {
  constructor(private readonly activityLogs = new ActivityLogRepository()) {}

  async record(input: CreateActivityLogInput) {
    return this.activityLogs.create(input);
  }
}
