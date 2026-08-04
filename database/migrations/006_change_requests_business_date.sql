-- 改班记录增加业务日期，用于按月/按日历范围查询
ALTER TABLE schedule_change_requests ADD COLUMN IF NOT EXISTS business_date date;
