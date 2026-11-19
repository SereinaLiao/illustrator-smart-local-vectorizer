#target illustrator
(function () {
    var folder = File($.fileName).parent;
    var doc = app.documents.add(DocumentColorSpace.RGB, 400, 300);
    var item = doc.placedItems.add();
    item.file = File(folder + "/sample.png");
    item.position = [80, 225];
    item.rotate(24);
    item.selected = true;
})();
