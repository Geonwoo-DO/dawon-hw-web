function getdata(collection, documents, field) {
    try {
      const userDoc = db.collection(collection).doc(documents).get(); 
      
      if (userDoc.exists) {
        const fieldValue = userDoc.data()[field];
        return fieldValue
      } else {
        return "none"
      }
    } catch (error) {
      return error
    }
  }
  
  function changedata(collection, documents, field, newValue) {
    try {
      db.collection(collection).doc(documents).update({
        [field]: newValue
      });
      return "success"
    } catch (error) {
      return error
    }
  }
  
  function makedata(collection, docId, uid, name, title, week, message, teacher, data, comment) {
    
      const newDoc = {
        "uid": uid,
        "name": name,
        "title": title,
        "week": week,
        "message": message,
        "teacher": teacher,
        "date": data,
        "comment": comment
      };
  
      try {
        const docRef = db.collection(collection).doc(docId).set(newDoc);
        return "success"
      } catch (error) {
        return error
      }
  }