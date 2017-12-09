var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://silverstarashok:silverstarashok@ds133856.mlab.com:33856/edward";
var result = [];
var collection;

MongoClient.connect(url, function(err, db) {
  if (err) throw err;

  collection = db.collection("user");

  //get all iser ids
  collection.distinct("user_id", function(err, items) { 
    if (err) throw err
    console.log(items);
  })

  //get all user names
  collection.distinct("user_name", function(err, items) {
      if (err) throw err
      console.log(items);
  })

  //get the courselist
  collection.distinct("courselist", function(err, items) {
      if (err) throw err
      console.log(items)
  })

//   db.collection("user").find({"user_name" : "Vasil Vasilev"}).toArray(function (err, result) { 
//       if (err) throw err
//       console.log(result);
//   })
  console.log("Database connected!");
  db.close();
});