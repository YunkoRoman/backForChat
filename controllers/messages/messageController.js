const {messageService} = require('../../services')
module.exports = async (req, res, next) => {
    try {
        console.log(req.body);

        messageService.saveMessage(req.body);

        res.json({
            success: true,
        });

    } catch (e) {
        console.log(e);
    }
};