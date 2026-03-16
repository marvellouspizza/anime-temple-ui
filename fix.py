import re

file_path = "src/hooks/useGameState.ts"
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update GameState
s = """  activityLog: ActivityEntry[];
  encounterCount: number;  // 累计结缘次数"""
s2 = """  activityLog: ActivityEntry[];
  scheduledLogs: any[]; // NEW
  encounterCount: number;  // 累计结缘次数"""
text = text.replace(s, s2)

# 2. Update INITIAL_STATE
s = """  activityLog: [],
  encounterCount: 0,"""
s2 = """  activityLog: [],
  scheduledLogs: [],
  encounterCount: 0,"""
text = text.replace(s, s2)

# 3. generateAgentLogs
# Only replace the loop inside
old_gen = """function generateAgentLogs("""

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
