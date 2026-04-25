// Mongo shell migration
// Usage:
//   mongosh "mongodb://localhost:27017/tuapp" docs/migrate-users-departmentId-to-departmentIds.js

const users = db.getCollection('users');

const result = users.updateMany(
  {
    departmentId: { $exists: true, $type: 'string', $ne: '' }
  },
  [
    {
      $set: {
        departmentIds: {
          $cond: [
            {
              $and: [
                { $ne: ['$departmentId', null] },
                { $ne: ['$departmentId', ''] }
              ]
            },
            ['$departmentId'],
            []
          ]
        }
      }
    },
    {
      $unset: 'departmentId'
    }
  ]
);

const normalizeResult = users.updateMany(
  {
    $or: [
      { departmentIds: { $exists: false } },
      { departmentIds: null }
    ]
  },
  {
    $set: {
      departmentIds: []
    }
  }
);

print('Usuarios migrados:', result.modifiedCount);
print('Usuarios normalizados:', normalizeResult.modifiedCount);
