// One selected child; class context and answer queues remain attached to that child.
export const studentKey = (uid, studentId) => 'student:' + uid + ':' + studentId;
export function selectProfile(profiles, selectedId) {
  return profiles.find(profile => profile.studentId === selectedId) || (profiles.length === 1 ? profiles[0] : null);
}
export function membershipContext(profile, selectedClassId) {
  const memberships = profile.memberships || [];
  return memberships.find(member => member.classId === selectedClassId)
    || (memberships.length === 1 ? memberships[0] : null);
}
